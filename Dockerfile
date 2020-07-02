FROM node

RUN apt update

# define where your code will stay and the container wil be started
WORKDIR /usr/src/app

# copy files
COPY package*.json ./
COPY . .

# install dependencies
RUN npm install

# esposed port
EXPOSE 3030

# entrypoint allows you to pass args when you run "docker run..." 
ENTRYPOINT ["node", "index.js"]