# Use a lightweight Ubuntu base image
FROM ubuntu:22.04

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Update system and install Tor + Node.js
RUN apt-get update && apt-get install -y \
    curl \
    tor \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set up the working directory inside the container
WORKDIR /usr/src/app

# Copy the dependency files and install them
COPY package*.json ./
RUN npm install

# Copy the rest of your backend code
COPY . .

# Expose the port your Express app uses
EXPOSE 3000

# The critical command: Start the Tor service in the background, THEN start Node
CMD service tor start && node index.js