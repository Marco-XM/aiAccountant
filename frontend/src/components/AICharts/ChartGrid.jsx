import React from "react";
import ChartGenerator from "../../Component/ChartGenerator/ChartGenerator";

const ChartGrid = ({ result }) => {
  // For now reuse ChartGenerator view to render result; in redesign we'll extract render layer
  return (
    <div>
      <ChartGenerator />
    </div>
  );
};

export default ChartGrid;
