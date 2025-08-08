FROM debian:bullseye-slim

# Install guacamole-server (guacd), Java (for WAR), supervisor, wget
RUN apt-get update && \
    apt-get install -y guacd openjdk-11-jre supervisor wget && \
    apt-get clean

# Download Guacamole web application (WAR)
RUN wget https://downloads.apache.org/guacamole/1.5.3/binary/guacamole-1.5.3.war -O /guacamole.war

# Copy supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose Guacamole port
EXPOSE 8080

# Start both processes
CMD ["/usr/bin/supervisord"]
