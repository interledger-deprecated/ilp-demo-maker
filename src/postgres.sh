#!/bin/bash
# This is run in the postgres Docker image to initialize all the postgres-y things

createdb "ilp-kit0"
createdb "ilp-kit1"
createdb "ilp-kit2"
# TODO create the other databases

