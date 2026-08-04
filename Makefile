# Docker helpers for the seizure project.
# Common agent flow:
#   make up        # first time / after pulling new deps
#   make composer  # after editing composer.json
#   make npm       # after editing package.json
#   make test      # run lint + types + phpunit (Laravel's `composer test`)
#   make build     # production front-end build
#   make down      # stop containers (keeps db_data)

DC = docker compose

up:
	$(DC) up -d --build

down:
	$(DC) down

shell:
	$(DC) exec php bash

artisan:
	$(DC) exec php php artisan

composer:
	$(DC) run --rm composer install

npm:
	$(DC) run --rm --entrypoint=npm node install

build:
	$(DC) run --rm --entrypoint=npm node run build

# Mirrors the `composer test` script defined in composer.json.
# Runs pint (parallel --test), phpstan, and phpunit.
test:
	$(DC) run --rm --entrypoint=npm node run lint:check
	$(DC) run --rm --entrypoint=npm node run types:check
	$(DC) run --rm --entrypoint=php php vendor/bin/phpunit

# Same as `test` but with prettier (CI parity).
ci:
	$(DC) run --rm --entrypoint=npm node run lint:check
	$(DC) run --rm --entrypoint=npm node run format:check
	$(DC) run --rm --entrypoint=npm node run types:check
	$(DC) run --rm --entrypoint=php php vendor/bin/phpunit

migrate:
	$(DC) exec php php artisan migrate

fresh:
	$(DC) exec php php artisan migrate:fresh --seed

logs:
	$(DC) logs -f
