async function checkAuth() {
  console.log('Checking authentication status...');
  try {
    const response = await fetch(`${BACKEND_URL}/auth/user`, { 
      credentials: 'include', 
      headers: { 'Accept': 'application/json' }
    });
    console.log('Auth response status:', response.status);
    if (response.ok) {
      const data = await response.json();
      console.log('User data:', data);
      document.getElementById('login-link').style.display = 'none';
      document.getElementById('user-dropdown').style.display = 'inline-block';
      document.getElementById('user-info').textContent = `${data.user.username}#${data.user.discriminator}`;
      document.getElementById('user-profile').style.display = 'flex';
      document.getElementById('user-avatar').src = data.user.avatar 
        ? `https://cdn.discordapp.com/avatars/${data.user.id}/${data.user.avatar}.png?size=100` 
        : 'https://via.placeholder.com/100';
      document.getElementById('user-greeting').textContent = `Hello, ${data.user.username}#${data.user.discriminator}!`;
      return data;
    } else {
      console.log('User not authenticated, status:', response.status);
      document.getElementById('login-link').style.display = 'inline';
      document.getElementById('user-dropdown').style.display = 'none';
      Swal.fire({
        title: 'Not Logged In',
        text: 'Please log in to view your dashboard.',
        icon: 'warning',
        confirmButtonColor: '#1e40af'
      }).then(() => {
        window.location.href = '/index.html';
      });
      return null;
    }
  } catch (error) {
    console.error('Error checking auth:', error.message);
    document.getElementById('login-link').style.display = 'inline';
    document.getElementById('user-dropdown').style.display = 'none';
    return null;
  }
}

async function loadBookings() {
  const myFlightsGrid = document.getElementById('my-flights-grid');
  const noMyFlightsMessage = document.getElementById('no-my-flights');
  const loadingMyFlights = document.getElementById('loading-my-flights');

  if (!myFlightsGrid || !noMyFlightsMessage || !loadingMyFlights) {
    console.error('Required elements for loadBookings not found');
    return;
  }

  console.log('Fetching bookings from:', `${BACKEND_URL}/bookings`);
  loadingMyFlights.style.display = 'block';
  myFlightsGrid.innerHTML = '';
  noMyFlightsMessage.style.display = 'none';

  try {
    const bookingsResponse = await fetch(`${BACKEND_URL}/bookings`, { 
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });
    console.log('Bookings fetch status:', bookingsResponse.status);
    if (!bookingsResponse.ok) {
      throw new Error(`Bookings fetch failed with status ${bookingsResponse.status}`);
    }
    const bookings = await bookingsResponse.json();
    console.log('Raw bookings response:', bookings);

    if (bookings.length === 0) {
      noMyFlightsMessage.style.display = 'block';
    } else {
      bookings.forEach((booking) => {
        const flight = booking.flight || { id: 'N/A', from: 'Unknown', to: 'Unknown', departure: 'N/A', aircraft: 'N/A' };
        const departureTime = new Date(flight.departure);
        const now = new Date();
        const timeDiff = departureTime - now;
        const canCheckIn = timeDiff > 0 && !booking.boardingPosition;
        const canCancel = timeDiff > 0;

        const card = document.createElement('div');
        card.className = 'booking-card';
        card.innerHTML = `
          <h3 class="font-swabold">Flight #${flight.id}</h3>
          <p><strong>From:</strong> ${flight.from}</p>
          <p><strong>To:</strong> ${flight.to}</p>
          <p><strong>Departure:</strong> ${new Date(flight.departure).toLocaleString()}</p>
          <p><strong>Aircraft:</strong> ${flight.aircraft}</p>
          <p><strong>Confirmation:</strong> ${booking.confirmationNumber}</p>
          ${canCheckIn ? `<a href="/checkin.html?confirmationNumber=${booking.confirmationNumber}" class="select-button">Check In Now</a>` : ''}
          ${canCancel ? `<button class="cancel-button" data-booking-id="${booking.id}" style="margin-top: ${canCheckIn ? '10px' : '0'};">Cancel Booking</button>` : ''}
          ${!canCheckIn && !canCancel ? '<p class="no-data">Flight has departed</p>' : ''}
        `;
        myFlightsGrid.appendChild(card);
      });

      document.querySelectorAll('.cancel-button').forEach(button => {
        button.addEventListener('click', async (e) => {
          const bookingId = e.target.getAttribute('data-booking-id');
          Swal.fire({
            title: 'Are you sure?',
            text: 'Do you want to cancel this booking? This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#1e40af',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, cancel it!'
          }).then(async (result) => {
            if (result.isConfirmed) {
              try {
                const response = await fetch(`${BACKEND_URL}/bookings/cancel`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ bookingId }),
                  credentials: 'include'
                });
                if (response.ok) {
                  Swal.fire('Booking Canceled', 'Your booking has been canceled successfully.', 'success').then(() => {
                    loadBookings();
                  });
                } else {
                  const data = await response.json();
                  Swal.fire('Error', data.error || 'Failed to cancel booking.', 'error');
                }
              } catch (error) {
                console.error('Error canceling booking:', error);
                Swal.fire('Error', 'Failed to cancel booking. Please try again.', 'error');
              }
            }
          });
        });
      });
    }
  } catch (error) {
    console.error('Error fetching bookings:', error.message);
    noMyFlightsMessage.textContent = `Error loading flights: ${error.message}. Please try again later.`;
    noMyFlightsMessage.style.display = 'block';
  } finally {
    loadingMyFlights.style.display = 'none';
  }
}

async function loadRewardsPoints() {
  try {
    const response = await fetch(`${BACKEND_URL}/rewards`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch rewards points');
    const data = await response.json();
    document.getElementById('rewards-points').textContent = data.points.toLocaleString();
  } catch (error) {
    console.error('Error loading rewards points:', error);
    document.getElementById('rewards-points').textContent = '0';
  }
}

async function checkDiscordLink() {
  try {
    const userData = await checkAuth();
    if (!userData) {
      console.log('No user data, cannot check Discord link');
      return;
    }
    console.log('Checking Discord link for user ID:', userData.user.id);
    const response = await fetch(`${BACKEND_URL}/linked/${userData.user.id}`, { 
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
      throw new Error(`Failed to check Discord link, status: ${response.status}`);
    }
    const data = await response.json();
    console.log('Discord link check response:', data);
    const linkedDiv = document.getElementById('discord-linked');
    const linkForm = document.getElementById('discord-link-form');
    if (data.linked) {
      console.log('Account is linked, hiding form');
      linkedDiv.style.display = 'block';
      linkForm.style.display = 'none';
    } else {
      console.log('Account is not linked, showing form');
      linkedDiv.style.display = 'none';
      linkForm.style.display = 'block';
    }
  } catch (error) {
    console.error('Error checking Discord link:', error);
    document.getElementById('discord-linked').style.display = 'none';
    document.getElementById('discord-link-form').style.display = 'block';
  }
}

async function linkDiscord() {
  const linkingCode = document.getElementById('linking-code').value.trim();
  if (!linkingCode) {
    Swal.fire({
      title: 'Error',
      text: 'Please enter a linking code.',
      icon: 'error',
      confirmButtonColor: '#1e40af'
    });
    return;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/linkdiscord/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkingCode }),
      credentials: 'include'
    });
    const data = await response.json();

    if (data.redirect) {
      Swal.fire({
        title: 'Redirecting',
        text: 'You will be redirected to Discord to authorize the linking.',
        icon: 'info',
        confirmButtonColor: '#1e40af',
        timer: 2000,
        timerProgressBar: true,
        willClose: () => {
          window.location.href = data.redirect;
        }
      });
    } else if (data.message) {
      Swal.fire({
        title: 'Success',
        text: data.message,
        icon: 'success',
        confirmButtonColor: '#1e40af'
      }).then(() => {
        checkDiscordLink();
      });
    } else {
      Swal.fire({
        title: 'Error',
        text: data.error || 'Failed to link Discord.',
        icon: 'error',
        confirmButtonColor: '#1e40af'
      });
    }
  } catch (error) {
    console.error('Error linking Discord:', error);
    Swal.fire({
      title: 'Error',
      text: 'Failed to link Discord. Please try again.',
      icon: 'error',
      confirmButtonColor: '#1e40af'
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, checking auth');
  const userData = await checkAuth();
  if (userData) {
    console.log('User authenticated, loading dashboard data');
    await Promise.all([loadBookings(), loadRewardsPoints(), checkDiscordLink()]);

    document.getElementById('login-link').addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Login link clicked');
      window.location.href = `${BACKEND_URL}/auth/discord`;
    });

    document.getElementById('logout-link').addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('Logout link clicked');
      try {
        const response = await fetch(`${BACKEND_URL}/auth/logout`, { credentials: 'include' });
        if (response.ok) {
          Swal.fire({
            title: 'Logged Out',
            text: 'You have been logged out successfully.',
            icon: 'success',
            confirmButtonColor: '#1e40af'
          }).then(() => {
            window.location.href = '/index.html';
          });
        }
      } catch (error) {
        console.error('Error logging out:', error);
        Swal.fire({
          title: 'Error',
          text: 'Failed to log out. Please try again.',
          icon: 'error',
          confirmButtonColor: '#1e40af'
        });
      }
    });

    document.getElementById('link-discord-btn').addEventListener('click', linkDiscord);
  }
});