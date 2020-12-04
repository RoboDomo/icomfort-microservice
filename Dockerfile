FROM node:11
ENV TZ=America/Los_Angeles
RUN useradd --user-group --create-home --shell /bin/false app
ENV HOME=/home/app
WORKDIR /home/app
COPY . /home/app
RUN cd $HOME && yarn install
CMD ["./entrypoint.sh"]
