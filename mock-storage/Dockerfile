FROM nginx

COPY html /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

RUN mkdir -p /usr/share/nginx/html/images && \
    chown nginx:www-data /usr/share/nginx/html/images && \
    chmod 775 /usr/share/nginx/html/images