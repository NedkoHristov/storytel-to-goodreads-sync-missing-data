FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY public ./public
COPY server.js ./

ENV PORT=4173
EXPOSE 4173

CMD ["npm", "start"]
