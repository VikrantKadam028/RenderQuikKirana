function updateActiveDot(currentPage) {
  const dots = document.querySelectorAll(".dot");
  dots.forEach((dot) => dot.classList.remove("active"));
  if (dots[currentPage]) {
    dots[currentPage].classList.add("active");
  }
}

updateActiveDot(0);

document.getElementById("submitBtn").addEventListener("click", async () => {
  const phoneNumber = document.getElementById("number").value;

  if (!phoneNumber.startsWith("+91") || phoneNumber.length !== 13) {
    alert("Please enter a valid phone number with +91.");
    return;
  }

  try {
    const response = await fetch("/send-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ number: phoneNumber }),
    });

    const data = await response.json();
    if (data.success) {
      alert("OTP sent successfully!");
    } else {
      alert("Failed to send OTP: " + data.message);
    }
  } catch (error) {
    console.error("Error:", error);
    alert("An error occurred while sending OTP");
  }
});