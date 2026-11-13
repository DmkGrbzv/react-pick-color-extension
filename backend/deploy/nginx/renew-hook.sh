#!/bin/sh
# Certbot deploy hook: a failed configuration check must prevent reload.
set -eu
/usr/sbin/nginx -t
/usr/bin/systemctl reload nginx
