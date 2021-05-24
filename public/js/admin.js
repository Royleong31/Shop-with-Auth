const deleteProduct = (btn) => {
  // console.log(`CSRF Token: ${csrfToken}`);
  // console.log(`Product ID: ${productId}`); // ?: Another way to get token and id is to pass them directly into the function
  const productId = btn.parentNode.querySelector("[name=productId]").value;
  const csrfToken = btn.parentNode.querySelector("[name=_csrf]").value;

  const productElement = btn.closest("article");

  fetch(`/admin/product/${productId}`, {
    method: "DELETE",
    headers: {
      "csrf-token": csrfToken, // ?: csrfToken is also in the header
    },
  })
    .then((response) => {
      console.log(response.status);
      if (response.status !== 200)
        throw "There was an error, please try again!";
      return response.json(); // ?: This helps to parsed the response into a json
    })
    .then((data) => {
      console.log(data);
      productElement.parentNode.removeChild(productElement); // ?: Can also use productElement.remove() but it does not work on IE
    })
    .catch((err) => {
      alert(err);
    });
};
