FROM guacamole/guacamole:latest

# Install supervisor og guacd
USER root
RUN apt-get update && apt-get install -y supervisor guacd && apt-get clean

# Copy supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 8080

CMD ["/usr/bin/supervisord"]
