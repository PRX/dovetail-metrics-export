FROM mhart/alpine-node:14

LABEL maintainer="PRX <sysadmin@prx.org>"
# LABEL org.prx.lambda="true"
LABEL org.prx.spire.publish.s3="LAMBDA_ZIP"

WORKDIR /app

CMD ["/bin/sh"]

RUN apk add zip

RUN mkdir --parents /.prxci

ADD package.json ./
RUN npm install --global npm@latest
RUN npm install --production
ADD . .

# This zip file is what will be deployed to the Lambda function.
# Add any necessary files to it.
RUN zip --quiet --recurse-paths /.prxci/build.zip node_modules src
