document.addEventListener('DOMContentLoaded', function() {
  // Estados brasileiros - SEM EMOJIS
  const states = [
    'AC - Acre',
    'AL - Alagoas',
    'AP - Amapá',
    'AM - Amazonas',
    'BA - Bahia',
    'CE - Ceará',
    'DF - Distrito Federal',
    'ES - Espírito Santo',
    'GO - Goiás',
    'MA - Maranhão',
    'MT - Mato Grosso',
    'MS - Mato Grosso do Sul',
    'MG - Minas Gerais',
    'PA - Pará',
    'PB - Paraíba',
    'PR - Paraná',
    'PE - Pernambuco',
    'PI - Piauí',
    'RJ - Rio de Janeiro',
    'RN - Rio Grande do Norte',
    'RS - Rio Grande do Sul',
    'RO - Rondônia',
    'RR - Roraima',
    'SC - Santa Catarina',
    'SP - São Paulo',
    'SE - Sergipe',
    'TO - Tocantins'
  ];

  const stateBtn = document.getElementById('stateBtn');
  const stateDropdown = document.getElementById('stateDropdown');
  const statesContainer = document.getElementById('statesContainer');
  const dropdownArrow = document.getElementById('dropdownArrow');
  const selectedState = document.getElementById('selectedState');

  // Populate states
  states.forEach((state) => {
    const option = document.createElement('div');
    option.className = 'state-option';
    option.textContent = '📍 ' + state;
    option.addEventListener('click', () => {
      selectedState.textContent = '📍 ' + state;
      stateDropdown.style.maxHeight = '0';
      dropdownArrow.textContent = '▲';
      localStorage.setItem('selectedState', '📍 ' + state);
    });
    statesContainer.appendChild(option);
  });

  // Toggle dropdown
  stateBtn.addEventListener('click', () => {
    const isOpen = stateDropdown.style.maxHeight && stateDropdown.style.maxHeight !== '0px';
    stateDropdown.style.maxHeight = isOpen ? '0' : '400px';
    dropdownArrow.textContent = isOpen ? '▲' : '▼';
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!stateBtn.contains(e.target) && !stateDropdown.contains(e.target)) {
      stateDropdown.style.maxHeight = '0';
      dropdownArrow.textContent = '▲';
    }
  });

  // Restore saved state from localStorage
  const savedState = localStorage.getItem('selectedState');
  if (savedState) {
    selectedState.textContent = savedState;
  }
});
