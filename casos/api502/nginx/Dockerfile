FROM nginx:1.29-alpine

COPY default.conf /etc/nginx/conf.d/default.conf
COPY scenarios/ /etc/nginx/scenarios/
COPY --chmod=755 control-entrypoint.sh /usr/local/bin/api502-nginx

ENTRYPOINT ["/usr/local/bin/api502-nginx"]

