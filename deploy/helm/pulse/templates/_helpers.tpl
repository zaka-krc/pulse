{{/* Chart name */}}
{{- define "pulse.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* Fully qualified app name, e.g. "myrelease-pulse" */}}
{{- define "pulse.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/* Common labels */}}
{{- define "pulse.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "pulse.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: pulse
{{- end }}

{{/* Selector labels for one component. Usage: include "pulse.selectorLabels" (dict "ctx" . "component" "backend") */}}
{{- define "pulse.selectorLabels" -}}
app.kubernetes.io/name: {{ include "pulse.name" .ctx }}
app.kubernetes.io/instance: {{ .ctx.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{/* Image reference. Usage: include "pulse.image" (dict "ctx" . "image" .Values.backend.image) */}}
{{- define "pulse.image" -}}
{{- printf "%s:%s" .image.repository (.image.tag | default .ctx.Chart.AppVersion | toString) }}
{{- end }}

{{- define "pulse.secretName" -}}
{{- .Values.secrets.existingSecret | default (printf "%s-secrets" (include "pulse.fullname" .)) }}
{{- end }}

{{- define "pulse.backendHost" -}}
{{- printf "%s-backend" (include "pulse.fullname" .) }}
{{- end }}

{{- define "pulse.postgresHost" -}}
{{- printf "%s-postgresql" (include "pulse.fullname" .) }}
{{- end }}

{{/*
Return a secret value: explicit value > value already stored in the cluster > random.
Keeps generated passwords stable across `helm upgrade`.
Usage: include "pulse.secretValue" (dict "value" .Values.x "existing" $existingData "key" "KEY")
*/}}
{{- define "pulse.secretValue" -}}
{{- if .value }}
{{- .value }}
{{- else if hasKey .existing .key }}
{{- index .existing .key | b64dec }}
{{- else }}
{{- randAlphaNum 40 }}
{{- end }}
{{- end }}
