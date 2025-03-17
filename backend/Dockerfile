# Use an official Node.js runtime as a parent image
FROM node:14

# Set the working directory
WORKDIR /usr/src/app

# Copy the backend directory contents into the container
COPY backend/ .

# Install backend dependencies
RUN npm install

# Install Python and necessary packages
RUN apt-get update && apt-get install -y python3 python3-pip

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Define environment variable
ENV PORT=3000

# Run the application
CMD ["npm", "start"]