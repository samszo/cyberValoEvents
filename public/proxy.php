<?php
// Proxy PHP — transfère les requêtes vers l'API Albert (Étalab)
// Résout le blocage CORS : la requête part du serveur, pas du navigateur.
// Usage : /proxy.php?path=chat/completions  ou  /proxy.php?path=models

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path   = trim($_GET['path'] ?? '', '/');
$target = 'https://albert.api.etalab.gouv.fr/v1/' . $path;
$method = $_SERVER['REQUEST_METHOD'];
$body   = file_get_contents('php://input');

$headers = ['Content-Type: application/json', 'Accept: application/json'];
if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
    $headers[] = 'Authorization: ' . $_SERVER['HTTP_AUTHORIZATION'];
}

$ch = curl_init($target);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_CUSTOMREQUEST  => $method,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_TIMEOUT        => 60,
]);

if ($method === 'POST' && $body !== '') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error    = curl_error($ch);
curl_close($ch);

if ($error) {
    http_response_code(502);
    echo json_encode(['error' => ['message' => 'Proxy error: ' . $error]]);
    exit;
}

http_response_code($httpCode);
header('Content-Type: application/json');
echo $response;
