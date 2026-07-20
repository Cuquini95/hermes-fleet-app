export default function handler(_request, response) {
  response.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
  response.status(404).end('Not Found')
}
