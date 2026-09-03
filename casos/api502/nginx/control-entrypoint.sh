#!/bin/sh
set -eu

mkdir -p /control/requests /control/results /control/snapshots /logs

# Cada inicio parte desde un estado conocido y saludable. El escenario 502 se
# activa de forma explicita desde la demo y nunca queda persistido por accidente.
cp /etc/nginx/scenarios/healthy-upstream.conf /control/active-upstream.conf

rm -f /control/requests/*.req

write_result() {
  operation="$1"
  status="$2"
  detail="$3"
  result_tmp="/control/results/${operation}.tmp"

  {
    printf 'status=%s\n' "$status"
    printf 'detail=%s\n' "$detail"
    date -u '+timestamp=%Y-%m-%dT%H:%M:%SZ'
  } >"$result_tmp"

  mv "$result_tmp" "/control/results/${operation}.status"
}

watch_requests() {
  while true; do
    for request in /control/requests/*.req; do
      [ -e "$request" ] || continue
      operation="$(basename "$request" .req)"

      case "$operation" in
        validate)
          if nginx -t >/control/results/validate.log 2>&1; then
            write_result validate ok "nginx configuration is valid"
          else
            write_result validate failed "nginx configuration is invalid"
          fi
          ;;
        reload)
          if nginx -t >/control/results/reload.log 2>&1 \
            && nginx -s reload >>/control/results/reload.log 2>&1; then
            write_result reload ok "nginx reloaded"
          else
            write_result reload failed "validation or reload failed"
          fi
          ;;
        *)
          write_result "$operation" failed "unsupported operation"
          ;;
      esac

      rm -f "$request"
    done

    sleep 0.2
  done
}

nginx -t
watch_requests &
exec nginx -g 'daemon off;'
