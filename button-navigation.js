document.addEventListener('DOMContentLoaded', function() {
  // Esperar um pouco para garantir que o DOM esteja completamente pronto
  setTimeout(function() {
    // Encontrar todos os botões "Entrar no Grupo"
    const buttons = document.querySelectorAll('button');
    
    buttons.forEach(button => {
      if (button.textContent.includes('Entrar no Grupo')) {
        button.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          // Navegar para a página de sucesso
          window.location.href = '/success.html';
        });
      }
    });
  }, 500);
});
