FROM node:15-alpine

ENV NODE_ENV=production
ENV NODE_PATH=/usr/local/lib/node_modules
COPY server.js .
RUN mkdir -p ./lib
COPY lib/* ./lib
CMD ["node", "server.js"]

EXPOSE 8080