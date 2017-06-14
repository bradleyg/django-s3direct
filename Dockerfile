FROM python:2.7
ENV PYTHONUNBUFFERED 1
RUN mkdir /code
COPY ./setup.sh /code
WORKDIR /code