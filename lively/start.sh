#!/bin/bash

lively_dir="$PWD/LivelyKernel"
squeakjs_dir=`dirname $PWD`
container_name="squeakjs-lively"

# if no docker image, build it
docker image inspect $container_name > /dev/null 2>&1
if [[ $? -ne 0 ]] ; then
    echo "Building docker image"
    docker build --rm -t $container_name .
fi

mkdir -p $lively_dir

# if the lively dir is empty first install it
dir_content=`ls -A "$lively_dir" 2>/dev/null`
if [[ -z $dir_content ]]; then
    pushd $lively_dir;
    branch=${git_branch-master}
    git clone --branch $branch --single-branch https://github.com/LivelyKernel/LivelyKernel .
    popd
fi

shutdown() {
  echo "Stopping container..."
  docker ps --filter "ancestor=$container_name" -q | xargs docker stop
}

trap shutdown SIGTERM SIGKILL SIGINT

echo "Starting docker"
docker run --rm \
    -v $lively_dir:/home/lively/LivelyKernel \
    -v $squeakjs_dir:/home/lively/LivelyKernel/users/SqueakJS \
    -p 9001-9004:9001-9004 \
    -t $container_name
