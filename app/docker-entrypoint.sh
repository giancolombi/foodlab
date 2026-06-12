#!/bin/sh
# Render nginx.conf at boot: resolve the container's DNS server (Railway's
# private network is IPv6-only, so wrap v6 addresses in brackets) and inject
# the API upstream, then hand off to nginx.
set -e

export NGINX_RESOLVER=$(awk '/^nameserver/ {ip=$2; if (ip ~ /:/) ip="["ip"]"; printf "%s ", ip}' /etc/resolv.conf)
envsubst '$API_UPSTREAM $NGINX_RESOLVER' \
  < /etc/nginx/conf.d/default.conf > /tmp/default.conf
mv /tmp/default.conf /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
