# Pulse Tracker

Application web de suivi de bugs et de gestion de tickets (React / TypeScript + Python / FastAPI).

En plus de la gestion des tickets et des commentaires, l'interface intègre un **inspecteur REST en temps réel** : chaque action de l'utilisateur (filtrage, création, modification partielle ou complète, ajout de commentaire, suppression) affiche la requête HTTP correspondante, le code de retour (`200`, `201`, `204`, `404`, `422`), le temps de réponse et les payloads JSON échangés.

## Environnement technique

- **Frontend** : React 19, TypeScript (`strict`), Vite, TanStack Query
- **Backend** : Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2
- **Tests** : Vitest + Testing Library (frontend), pytest + Ruff (backend)
- **Déploiement** : Docker & Docker Compose, Kubernetes (Helm), GitLab CI/CD

## Structure du projet

```text
pulse/
├── backend/                 # API REST FastAPI, modèles SQLAlchemy, schémas Pydantic et tests pytest
├── frontend/                # SPA React + TypeScript, client HTTP, inspecteur REST et tests Vitest
├── deploy/helm/pulse/       # Chart Helm (Deployments, StatefulSet Postgres, Ingress, HPA, PDB)
├── docker-compose.yml       # Stack locale conteneurisée (PostgreSQL 16 + FastAPI + Nginx)
├── .gitlab-ci.yml           # Pipeline GitLab CI/CD (lint -> test -> build Kaniko -> deploy Helm)
└── start.bat                # Script de lancement rapide sous Windows
```

## Démarrage rapide

### Sous Windows (script unique)

```powershell
.\start.bat
```

Ce script installe les dépendances si nécessaire et lance le backend FastAPI ainsi que le frontend Vite dans le même terminal :
- Application : http://localhost:5173
- Documentation Swagger OpenAPI : http://localhost:8000/api/docs

Pour lancer tous les linters et tests automatisés (`ruff`, `pytest`, `tsc`, `vitest`) :

```powershell
.\start.bat test
```

### Commandes manuelles (Linux / macOS / Windows)

**Backend :**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # ou .\.venv\Scripts\Activate.ps1 sous Windows
pip install -r requirements-dev.txt

uvicorn app.main:app --reload --port 8000
pytest
```

**Frontend :**
```bash
cd frontend
npm install
npm run dev
npx vitest run
```

## Conception de l'API REST

L'API expose deux ressources liées (`Ticket` et sa sous-ressource `Comment`) :

| Méthode | Endpoint | Description | Codes HTTP |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tickets` | Liste les tickets (filtres `?status=`, `?severity=`, `?assignee=`, `?search=`) | `200 OK` |
| `GET` | `/api/tickets/stats` | Compteurs par statut et nombre de tickets critiques actifs | `200 OK` |
| `GET` | `/api/tickets/{id}` | Détail d'un ticket avec ses commentaires | `200 OK`, `404 Not Found` |
| `POST` | `/api/tickets` | Création d'un ticket | `201 Created`, `422 Unprocessable Entity` |
| `PUT` | `/api/tickets/{id}` | Remplacement complet d'un ticket | `200 OK`, `404`, `422` |
| `PATCH` | `/api/tickets/{id}` | Mise à jour partielle (ex. changement de statut seul) | `200 OK`, `404`, `422` |
| `DELETE` | `/api/tickets/{id}` | Suppression du ticket et de ses commentaires en cascade | `204 No Content`, `404` |
| `GET` | `/api/tickets/{id}/comments` | Liste les commentaires d'un ticket | `200 OK`, `404` |
| `POST` | `/api/tickets/{id}/comments` | Ajoute un commentaire sur un ticket | `201 Created`, `404`, `422` |
| `DELETE` | `/api/tickets/{id}/comments/{cid}` | Supprime un commentaire | `204 No Content`, `404` |
| `GET` | `/api/health/live` & `/ready` | Sondes Kubernetes `liveness` et `readiness` (vérifie la connexion SQL) | `200 OK`, `503` |

## Conteneurisation et déploiement

### Docker Compose

Lance PostgreSQL 16, le backend FastAPI et le frontend compilé servi par Nginx (images multi-stages non-root) :

```bash
docker compose up --build
# Application accessible sur http://localhost:8080
```

### Kubernetes (Helm)

```bash
helm lint deploy/helm/pulse

helm upgrade --install pulse deploy/helm/pulse \
  --namespace pulse-staging \
  --create-namespace \
  -f deploy/helm/pulse/values-staging.yaml

helm test pulse -n pulse-staging
```

### GitLab CI/CD (`.gitlab-ci.yml`)

Le pipeline s'exécute en 4 stages :
1. **`lint`** : `ruff check` / `ruff format --check`, `tsc --noEmit`, `helm lint` et `helm template`.
2. **`test`** : `pytest` (avec un conteneur service `postgres:16-alpine`) et `vitest --coverage`, avec publication des rapports JUnit et Cobertura dans GitLab.
3. **`build`** : build des images Docker via Kaniko et push dans le GitLab Container Registry.
4. **`deploy`** : déploiement Helm automatique sur `staging` (branche `main`) et manuel sur `production` (`--atomic --wait`).
