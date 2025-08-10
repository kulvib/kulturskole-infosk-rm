#!/bin/sh
echo "Entrypoint.sh startes..."
envsubst < /etc/guacamole/guacamole.properties > /etc/guacamole/guacamole.properties.subst
mv /etc/guacamole/guacamole.properties.subst /etc/guacamole/guacamole.properties
ls -l /etc/guacamole/extensions/
ls -l /etc/guacamole/
exec /usr/local/tomcat/bin/catalina.sh run
