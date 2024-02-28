debug:
	@docker build -t debug-jekyll . -f Dockerfile
	@docker run -it --rm  -v $(PWD):/jekyll -w /jekyll -p 4000:4000 debug-jekyll /bin/bash -c "npm i && npm run build && bundle install && bundle exec jekyll serve --host 0.0.0.0"

.PHONY: debug