<?php
include "config.php";
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $phoneNumber = $_POST['number'];

    if (preg_match("/^\+91\d{10}$/", $phoneNumber)) {
        $stmt = $conn->prepare("INSERT INTO phone_numbers (number) VALUES (?)");
        $stmt->bind_param("s", $phoneNumber);

        if ($stmt->execute()) {
            header("Location: acceptOTP.html");
            exit;
        } else {
            echo "Error: " . $stmt->error;
        }
        $stmt->close();
    } else {
        echo "Invalid phone number format.";
    }
}

$conn->close();
