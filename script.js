// ================================
// SKYRL WEBSITE INTERACTIONS
// ================================


// Smoothly move to the simulation
function scrollToSimulation() {
    const simulation = document.getElementById("simulation");

    if (simulation) {
        simulation.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}


// ================================
// LOGIN MODAL
// ================================

function openLogin() {
    const modal = document.getElementById("loginModal");

    if (modal) {
        modal.classList.add("active");
        document.body.style.overflow = "hidden";
    }
}


function closeLogin(event) {

    if (event && event.target !== event.currentTarget) {
        return;
    }

    const modal = document.getElementById("loginModal");

    if (modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "";
    }
}


// Close login with Escape key
document.addEventListener("keydown", function(event) {

    if (event.key === "Escape") {
        const modal = document.getElementById("loginModal");

        if (modal && modal.classList.contains("active")) {
            closeLogin();
        }
    }

});


// ================================
// NAVBAR SHADOW
// ================================

window.addEventListener("scroll", function() {

    const navbar = document.querySelector(".navbar");

    if (!navbar) return;

    if (window.scrollY > 20) {
        navbar.style.boxShadow = "0 5px 25px rgba(0,0,0,0.04)";
    } else {
        navbar.style.boxShadow = "none";
    }

});


// ================================
// SIMPLE DRONE ANIMATION
// ================================

const drone = document.querySelector(".drone");

if (drone) {

    let progress = 0;

    function animateDrone() {

        progress += 0.003;

        if (progress > 1) {
            progress = 0;
        }

        // Creates a subtle floating movement
        const x = Math.sin(progress * Math.PI * 2) * 14;
        const y = Math.cos(progress * Math.PI * 2) * 8;

        drone.style.transform =
            `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

        requestAnimationFrame(animateDrone);
    }

    animateDrone();
}


// ================================
// GOOGLE BUTTON PLACEHOLDER
// ================================

const googleButton = document.querySelector(".google-btn");

if (googleButton) {

    googleButton.addEventListener("click", function() {

        alert(
            "Google authentication will be connected here when the SkyRL backend is added."
        );

    });

}
