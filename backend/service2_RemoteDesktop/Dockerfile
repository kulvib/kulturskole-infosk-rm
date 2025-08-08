FROM guacamole/guacamole:latest

USER root
RUN apt-get update && apt-get install -y supervisor guacd && apt-get clean

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 8080

CMD ["/usr/bin/supervisord"]
