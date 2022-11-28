# -----------------------
# Typescript > Javascript
# -----------------------
FROM node:16-alpine3.16 as node-build

ENV WORKDIR=/home/node

ADD scripts ${WORKDIR}/scripts

WORKDIR ${WORKDIR}
RUN cd scripts && \
    npm install && \
    node ./build.js

# ---
# Run
# ---
FROM loadimpact/k6
ENV WORKDIR=/home/k6

WORKDIR ${WORKDIR}

USER root
RUN apk add --no-cache aws-cli

USER k6

RUN mkdir ${WORKDIR}/scripts
COPY --from=node-build /home/node/scripts/dist ${WORKDIR}/scripts

ENTRYPOINT ["sh"]
