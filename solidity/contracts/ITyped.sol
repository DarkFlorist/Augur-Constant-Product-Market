pragma solidity 0.8.29;


interface ITyped {
    function getTypeName() external view returns (bytes32);
}