FROM lambci/lambda:build-nodejs12.x

LABEL maintainer="PRX <sysadmin@prx.org>"
LABEL org.prx.lambda="true"

WORKDIR /app

RUN yum install -y zip

RUN mkdir -p /.prxci

ADD package.json ./
RUN npm install --production
ADD . .

# This zip file is what will be deployed to the Lambda function.
# Add any necessary files to it.
RUN zip -rq /.prxci/build.zip node_modules src
