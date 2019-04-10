#!/bin/bash
sudo apt-get -y install mosquitto vim 
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash
sudo apt-get install -y nodejs

cd /home/pi/mylaundry/Laundry_Analytic
sudo npm install
sudo npm install sqlite3

########
