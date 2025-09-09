FROM mcr.microsoft.com/devcontainers/typescript-node:20-bookworm

ADD install-ProX-Code.sh /root/
RUN /root/install-ProX-Code.sh

RUN git config --system codespaces-theme.hide-status 1

USER node
RUN npm install -g node-gyp
RUN NPM_CACHE="$(npm config get cache)" && rm -rf "$NPM_CACHE" && ln -s /ProX-Code-dev/npm-cache "$NPM_CACHE"
RUN echo 'export DISPLAY="${DISPLAY:-:1}"' | tee -a ~/.bashrc >> ~/.zshrc

USER root
CMD chown node:node /ProX-Code-dev && sudo -u node mkdir -p /ProX-Code-dev/npm-cache && sleep inf
