#!/bin/bash
URL="https://www.kulturskolenviborg.dk/infoskaerm1"
google-chrome --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --incognito --disk-cache-dir=/dev/null --disable-popup-blocking $URL
