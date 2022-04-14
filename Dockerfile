FROM lambci/lambda:build-nodejs12.x

MAINTAINER PRX <sysadmin@prx.org>
LABEL org.prx.lambda="true"

WORKDIR /app

# ENTRYPOINT [ "npm", "run" ]

RUN yum install -y rsync && yum clean all && rm -rf /var/cache/yum
ADD yarn.lock ./
ADD package.json ./
RUN npm install --quiet --global yarn && yarn install
ADD . .
RUN npm run build
