# AWS Ticketless Parking System

![Ticketless Parking System](./Ticketless%20parking%20system.jpg)

## Overview

This is a ticketless parking system built using AWS services and React with TypeScript and Vite.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: AWS Lambda
- **Database**: PostgreSQL (RDS)
- **Storage**: Amazon S3
- **Image Recognition**: Amazon Rekognition
- **API Gateway**: AWS API Gateway
- **Infrastructure**: AWS VPC with NAT Gateway

## Features

- Modern React application with Vite bundler
- Type-safe development with TypeScript
- Fast development and build times with Vite
- AWS Lambda integration
- PostgreSQL RDS database support
- License plate recognition using Amazon Rekognition
- S3 direct upload capability

## Architecture

### Image Upload and Processing Flow

1. **Image Upload**: Users upload an image of a number plate through the React frontend to the API Gateway, which triggers a Lambda function that generates a presigned S3 URL for direct upload.

2. **S3 Storage**: The image is stored directly in Amazon S3 using the presigned URL (S3 direct upload method).

3. **Rekognition Trigger**: Once the image is stored in S3, an event triggers a second Lambda function that invokes Amazon Rekognition in the Ireland region (eu-west-1) to analyze the image and extract license plate data.

4. **Network Routing**: 
   - Traffic from the private VPC subnet flows through the NAT Gateway in the public subnet
   - The public route table directs traffic from the NAT Gateway to the Internet Gateway
   - This enables secure communication with Rekognition service in eu-west-1

5. **Data Storage**: The analysis results (returned as bytes) are sent back through the same network pathway and stored in the PostgreSQL RDS database.

6. **Data Retrieval**: Users can query the stored analysis data through the API Gateway, allowing them to view parking and license plate information on the frontend.

## Getting Started

### Prerequisites

- Node.js and npm installed
- AWS account configured
- AWS CLI configured with appropriate credentials

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Build

To build for production:

```bash
npm run build
```

## License

MIT
