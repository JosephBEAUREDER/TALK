# Use official Node.js image as base
FROM node:18

# Install Python 3
RUN apt-get update && apt-get install -y python3 python3-pip

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY backend/package*.json ./
RUN npm install

# Copy the rest of the backend code
COPY backend/ .

# Expose port 3000
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]