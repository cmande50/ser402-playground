function DessertsList(props) {
  // Implement the component here.

  const lowCalDesserts = props.data.map((d) => {
    if (d.calories <= 500) {
      return <li>${d.name} - ${d.calories} cal.</li>
    }
  });

  return (
    <ul>
      {lowCalDesserts}
    </ul>
  );
}

export default DessertsList;
