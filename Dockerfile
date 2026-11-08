FROM node:22-alpine
WORKDIR /app

# Install OpenSSL and libc compatibility for Prisma
RUN apk add --no-cache openssl libc6-compat

COPY package.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
