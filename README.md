# Внешние зависимости
___
### REDIS
___
Подключение осуществляется при помощи строки подключения в формате url:

_redis://host:port_ (если без пароля)

_redis://:password@host:6379_ если с паролем. Двоеточие перед паролем __ОБЯЗАТЕЛЬНО__) 

# Обзор

Задача системы - абстрагировать внутри двух "парных" модулей (TaskClient и TaskProcessor) рабочую очередь с использованием REDIS.
___
## TaskClient

В разработке...
___
## TaskProcessor

В разработке...
___
## Возможности

### - Ожидание выполнения задачи.
### - Приоритезация задач.
### - Таймаут клиента.
### - Настройка поллинга (опроса).
### - Кеширование.
### - Валидация
### - Prefetch (количество задач, которые может брать один worker)

___
# Quick start

``` bash
npm run start:processor
npm run client:push 10 # any number
```

#