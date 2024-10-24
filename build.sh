rm -r ./dist
mkdir dist
cp Dockerfile ./dist
cp -r ./src/* ./dist
cp *.json dist
cd dist
docker build -t jwt-pizza-service .
