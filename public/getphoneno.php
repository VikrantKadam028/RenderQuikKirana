<?php
include "config.php";

$sql = "SELECT number FROM phone_numbers LIMIT 1";  
$result = $conn->query($sql);

if ($result->num_rows > 0) {
    $row = $result->fetch_assoc();
    echo json_encode(['success' => true, 'number' => $row['number']]);
} else {
    echo json_encode(['success' => false, 'message' => 'No phone number found']);
}

$conn->close();
