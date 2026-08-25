// Configuração central do funil — edite aqui para manter os números e depoimentos reais/atualizados.
window.UAI_CONFIG = {
  members: 473,
  maxMembers: 500,
  extraVehicles: 623,
  state: 'São Paulo (SP)',

  // Nomes usados no popup de notificação ("Fulano acabou de entrar no grupo").
  // Use apenas nomes de pessoas reais que autorizaram o uso, ou remova este recurso.
  notifications: [
    { name: 'Rafael Santos Lima', avatar: 'images/review-avatar1.jpeg' },
    { name: 'Juliana Ferreira Rocha', avatar: 'images/review-avatar2.jpeg' },
    { name: 'Carlos Eduardo Silva', avatar: 'images/review-avatar3.avif' }
  ],

  // Depoimentos — substitua pelos depoimentos reais de compradores.
  reviews: [
    {
      name: 'Renan Oliveira',
      avatar: 'images/review-avatar1.jpeg',
      stars: 5,
      when: 'há 2 dias',
      text: 'Peguei esse Gol G7 2023 por R$32.000 dentro do grupo. Fipe dele tá R$54 mil, fui desconfiado achando que tinha pegadinha mas o carro tá redondo demais, motor impecável. Já anunciei por 48 e tenho gente interessada.',
      photo: 'images/review-gol.webp'
    },
    {
      name: 'Antônio Carlos',
      avatar: 'images/review-avatar2.jpeg',
      stars: 5,
      when: 'há 5 dias',
      text: 'Esse Onix era pra minha esposa mas gostei tanto que fiquei pra mim kkk. Paguei R$28.900 num carro que a Fipe marca 45. Fechei direto com a loja indicada no grupo, tudo no cartório, documentação certinha.',
      photo: 'images/review-onix.webp'
    },
    {
      name: 'Marcos Maia',
      avatar: 'images/review-avatar3.avif',
      stars: 5,
      when: 'há 1 semana',
      text: 'Comprei essa Strada por R$29.900 pra rodar na minha distribuidora. Apareceu no grupo numa quinta, sexta de manhã já busquei. Carroceria e mecânica em dia, já tá trabalhando.',
      photo: 'images/review-strada.webp'
    }
  ],

  cars: [
    { model: 'Corsa Wind 2002', price: 'R$ 6.900', image: 'images/car1.webp' },
    { model: 'Celta Life 2006', price: 'R$ 9.490', image: 'images/car2.webp' },
    { model: 'Palio ELX 2005', price: 'R$ 11.900', image: 'images/car3.webp' },
    { model: 'Gol G4 2008', price: 'R$ 14.900', image: 'images/car4.webp' },
    { model: 'Onix LT 2019', price: 'R$ 32.900', image: 'images/car5.webp' },
    { model: 'HB20 1.6 2018', price: 'R$ 25.900', image: 'images/car6.webp' },
    { model: 'Civic LXR 2013', price: 'R$ 35.200', image: 'images/car7.webp' },
    { model: 'Corolla 2014', price: 'R$ 38.800', image: 'images/car8.webp' }
  ],

  vipPrice: 'R$ 49,90'
};
