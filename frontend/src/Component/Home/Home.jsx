import React, { useContext } from "react";
import { Helmet } from "react-helmet";
import { AuthContext } from "../../Context/AuthContext";

const Home = () => {
  const { token } = useContext(AuthContext);

  return (
    <section className="my-10 p-10 w-3/4 mx-auto">
      <Helmet>
        <title>Home - AI Accountant</title>
      </Helmet>
      <h1 className="text-center mb-8 text-4xl font-bold">
        Welcome to AI Accountant
      </h1>
      <div className="text-center">
        <p className="text-lg mb-4">You are successfully logged in!</p>
        {token && (
          <p className="text-sm text-gray-600">
            Your session is active and secure.
          </p>
        )}
      </div>
    </section>
  );
};

export default Home;
