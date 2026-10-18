FROM node:24-alpine
WORKDIR /app
COPY . .
RUN npm install --no-audit --no-fund && npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm","start"]
