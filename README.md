# Telegram Crypto News Bot

Este proyecto es un bot de Telegram que envía noticias sobre criptomonedas a un canal específico utilizando Node.js y MongoDB. La configuración del bot está gestionada a través de GitHub Actions para la automatización del cron job que obtiene y envía noticias.

## Funcionalidades

- **Obtención de Noticias**: El bot obtiene noticias sobre criptomonedas utilizando la API de CoinGecko.
- **Envío de Noticias**: Envía las noticias al canal de Telegram especificado.
- **Manejo de Noticias**: Verifica y almacena las noticias enviadas para evitar duplicados.
- **Eliminación de Noticias Antiguas**: Borra noticias antiguas de la base de datos MongoDB para mantener el almacenamiento limpio.
- **Programación de Tareas**: Utiliza GitHub Actions para ejecutar el cron job que maneja la obtención y envío de noticias cada 10 minutos.

## Tecnologías

- **Node.js**: Entorno de ejecución para JavaScript en el servidor.
- **MongoDB**: Base de datos NoSQL utilizada para almacenar URLs de noticias.
- **Axios**: Cliente HTTP para realizar solicitudes a APIs externas.
- **dotenv**: Carga las variables de entorno desde un archivo `.env`.
- **node-cron**: Librería para la programación de tareas cron en Node.js.
- **GitHub Actions**: Para la automatización de despliegues y ejecución de tareas cron.

## Requisitos

- Node.js 20.x
- MongoDB
- Token de Bot de Telegram y ID de Chat

## Contacto

Para preguntas o soporte, por favor contacta a través de mi [sitio web](https://eliashania.netlify.app/).

---

¡Gracias por utilizar el Telegram Crypto News Bot!
