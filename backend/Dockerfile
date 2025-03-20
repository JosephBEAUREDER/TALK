# Use official Node.js image as base
FROM node:18

# Install Python 3 and venv
RUN apt-get update && apt-get install -y python3 python3-venv python3-pip

# Set working directory inside the container
WORKDIR /app

# Copy the backend's package.json and install dependencies
COPY package*.json ./
RUN npm install

# Create a virtual environment and install Python dependencies
RUN python3 -m venv /app/venv
COPY requirements.txt .
RUN /app/venv/bin/pip install -r requirements.txt

# Copy the rest of the backend code
COPY . .

# Expose port 8080
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]