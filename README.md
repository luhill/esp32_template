# ESP32 Template
This project contains two main sections the back end and front end web based ui for an esp32

Backend:(/src)
    -Update src/config/secrets.h with your wifi and password
    -The top level folder src contains main.cpp and other libraries for building the back end
    -The back end uses the Multi_Control class in Control.h to build a generic control
        -Controls are built around arduino json which allows them to generate their own ui json that is used by the front end to display them
        -The std::vector<ControlBase*> uiRegistry allows web updates to be pushed to the relevant control
        -Control values that are marked as persistent are automatically saved when they are changed, and reloaded after a restart
        -Controls can be given an onUpdate function that allows subscritpion to change events.
        -Modules are used to contain a reusable control and its relavent logic.

Frontend: (/web)
    -The front end opens a websocket with the back end. Websockets along with jsx and conditional rendering allow the webpage to be fast and exchange only what has changed
    -The front end expects a message from the backend every 5sec, if not recieved it will close the connection and attempt to reconnect.
    -Vite is used to build the webpage from jsx components and also to generate the inline index.html.gz file into the web/dist
    -Vite allows the ui to be built and tested in real time by running commands:
        cd src/web
        npm run dev
    -The dist files can be built running the following command
        npm run build
    -Or the ui files are automatically generated and built into littlefs.bin using the platformio "Build Filesystem Image" and "Upload Filesystem Image" buttons in the platformio tab
        -platformio is instructed to run myscript.py before the filesystem is built which copies the relevant files from /web/dist into the /data folder

    -Deploy front end to Github:
        npm run build:pwa
        npm run deploy
        

    -Deploy front end to raspberry pi: runs a script to ssh into your pi, copy the front end web interface and open a browser tab to it.
    -Make sure to create a file: ".env.local" in the same directory as package.json with your pi user name and address.
    -The content of .env.local should be:
        
        #update to your raspberry pi ssh username
        VITE_PI_SSH_USERNAME="username"

        #update to your raspberry pi address
        VITE_PI_ADDRESS="your-pi.local"

    Deploy to your pi with:
        npm run deploy:pi